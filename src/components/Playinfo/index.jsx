import React, { useEffect, useRef, useState } from 'react';
import { Button, Slider, Row, Col, Popover, Card } from 'antd';
import { CaretRightOutlined, PauseOutlined } from '@ant-design/icons';
import { utctostrtime } from '@/utils/utctostrtime';
import { useSubscribe, usePublish, useUnsubscribe } from '@/utils/usePubSub';
import { publish } from 'pubsub-js';

//设定进度条
/*
setMarks({
    0: utctostrtime(starttime),
    100: utctostrtime(endtime)
})*/

export default function Playinfo() {
    const [timelineval, setTimelineval] = useState(20)
    const [marks, setMarks] = useState({
        0: 'start',
        100: 'end'
    })
    //清除更新组件重复订阅的副作用
    const unsubscribe = useUnsubscribe();
    //订阅进度条位置
    unsubscribe('mark');
    const updatemark = useSubscribe('mark', function (msg: any, data: any) {
        setMarks(data.mark)
        setTimelineval(data.thistime)
    });



    const [play, setplay] = useState(true)
    function playstop() {
        setplay(!play)
        publish('play', !play)
    }

    //拖动进度条
    const changetime = (e) => {
        if (play == false) {
            setTimelineval(e)
        }
        setMarks({
            0: marks['0'],
            [e]: e / 100 * ((new Date(marks['100'])).valueOf() - (new Date(marks['0'])).valueOf()) + (new Date(marks['0'])).valueOf(),
            100: marks['100']
        })
        //发布播放位置
        publish('playtime', e)
    }

    //订阅按下柱状图时的播放信息
    unsubscribe('playb');
    const updateplay = useSubscribe('playb', function (msg: any, data: any) {
        setplay(data)
    });


    const [showplayinfo, setshowplayinfo] = useState(false)
    //订阅地图样式
    unsubscribe('showplayinfo');
    const updatePlayinfo = useSubscribe('showplayinfo', function (msg: any, data: any) {
        setshowplayinfo(data)
    });


    const [speed, setSpeed] = useState(1)
    const addspeed = () => {

        let thisspeed = (speed + 1) % 4
        let animationSpeed = thisspeed == 1 ? 1 : thisspeed == 2 ? 2 : thisspeed == 3 ? 5 : 10
        publish('animationSpeed', animationSpeed)
        setSpeed(thisspeed)

    }

    return <Popover visible={showplayinfo}  content={<div className="playinfo" >
        <Card size='small'>
        
            <Row >
                <Col span={2} >
                    <Button type="primary" shape="round" icon={play ? <PauseOutlined /> : <CaretRightOutlined />} onClick={playstop}></Button>
                </Col>
                <Col span={2} >
                    <Button type="primary" shape="round" onClick={addspeed}>{speed == 1 ? '×1' : speed == 2 ? '×2' : speed == 3 ? '×5' : 'x10'}</Button>
                </Col>
                <Col offset={1} span={18} >
                    <Slider marks={marks} tooltipVisible={false} value={timelineval} onChange={changetime} />
                </Col>
            </Row>
            
            </Card></div>}><Button type="primary" className='playinfobtn' ></Button>
    </Popover>
}
